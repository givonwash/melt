#!/usr/bin/env python3.12


import json
import os
import sys
from argparse import Action, ArgumentParser, Namespace
from json import JSONDecodeError
from typing import Any, Optional, TypedDict
from urllib import request
from urllib.request import Request

Json = dict[str, "Json"] | list["Json"] | bool | int | float | str | None


class ArgumentParserWithEnvVarDefault(ArgumentParser):
    def add_argument(
        self, *names_or_flags: str, envvar: Optional[str] = None, **kwargs: Any
    ) -> Action:
        if envvar is not None and (value := os.getenv(envvar)) is not None:
            kwargs |= {"required": False, "default": value}
            return super().add_argument(*names_or_flags, **kwargs)
        else:
            return super().add_argument(*names_or_flags, **kwargs)


def try_loads(s: str) -> Json:
    try:
        return json.loads(s)
    except JSONDecodeError:
        return s


def parse_args(args: list[str]) -> Namespace:
    parser = ArgumentParserWithEnvVarDefault()
    parser.add_argument(
        "--url-to-get",
        envvar="URL_TO_GET",
        required=True,
        help="URL to make initial GET request to",
    )
    parser.add_argument(
        "--get-response-check-path",
        envvar="GET_RESPONSE_CHECK_PATH",
        default=[],
        type=json.loads,
        help="Path to grab value from in response to initial GET request to determine if failed",
    )
    parser.add_argument(
        "--get-response-failed-value",
        envvar="GET_RESPONSE_FAILED_VALUE",
        required=True,
        type=try_loads,
        help="Value to check at GET_RESPONSE_CHECK_PATH to determine if response indicates failure",
    )
    parser.add_argument(
        "--get-response-return-value-path",
        envvar="GET_RESPONSE_RETURN_VALUE_PATH",
        required=True,
        type=json.loads,
        help="Path to grab value from in initial GET response if deemed successful",
    )
    parser.add_argument(
        "--url-to-post",
        envvar="URL_TO_POST",
        required=True,
        help="URL to make subsequent POST request to should GET request be deemed a failure",
    )
    parser.add_argument(
        "--payload-to-post",
        envvar="PAYLOAD_TO_POST",
        required=True,
        type=try_loads,
        help="Data to include in subsequent POST request should GET request be deemed a failure",
    )
    parser.add_argument(
        "--patch-path-for-payload-to-post",
        envvar="PATCH_PATH_FOR_PAYLOAD_TO_POST",
        type=json.loads,
        help="Path to place PATCH_PATH_FOR_PAYLOAD_TO_POST at in PAYLOAD_TO_POST",
    )
    parser.add_argument(
        "--patch-value-for-payload-to-post",
        envvar="PATCH_VALUE_FOR_PAYLOAD_TO_POST",
        type=try_loads,
        help="Value to patch into PAYLOAD_TO_POST at PATCH_PATH_FOR_PAYLOAD_TO_POST",
    )
    parser.add_argument(
        "--post-response-return-value-path",
        envvar="POST_RESPONSE_RETURN_VALUE_PATH",
        default=[],
        type=json.loads,
        help="Path to grab value from subsequent POST response should GET request be deemed a failure",
    )

    return parser.parse_args(args)


def get(url: str) -> Json:
    with request.urlopen(
        Request(
            url=url,
            headers={"Accepts": "application/json"},
        )
    ) as response:
        return json.load(response)


def post(url: str, data: bytes) -> Json:
    with request.urlopen(
        Request(
            method="POST",
            url=url,
            headers={
                "Content-Type": "application/json",
                "Accepts": "application/json",
            },
            data=data,
        )
    ) as response:
        return json.load(response)


class DigFilterByKeySpec(TypedDict):
    key: str
    value: Json


class DigFilterByKey(TypedDict):
    filterByKey: DigFilterByKeySpec


class DigError(Exception): ...


def dig(j: Json, path: list[str | DigFilterByKey]) -> Json:
    match (j, path):
        case (dict(), [p, *ps]):
            match p:
                case str():
                    return dig(j[p], ps)
                case _:
                    raise DigError("Unexpected %s received at %s", p, j)
        case (list(), [p, *ps]):
            match p:
                case "*":
                    return [dig(element, ps) for element in j]
                case str():
                    return dig(j[int(p)], ps)
                case _:
                    filter_by_key = p["filterByKey"]
                    filtered: Json = [
                        element
                        for element in j
                        if isinstance(element, dict)
                        and element.get(filter_by_key["key"]) == filter_by_key["value"]
                    ]
                    return dig(filtered, ps)
        case (_, []):
            return j
        case _:
            raise DigError("Non-empty path (%s) for (%s)", path, j)


def patch(j: Json, value: Json, path: list[str]) -> Json:
    match (j, value, path):
        # case: `j` is a `dict` and `path` is non-empty
        case (dict(), _, [p, *ps]):
            return j | {p: patch(j[p], value, ps)}
        # case: `j` is a `list` and `path` is non-empty
        case (list(), _, [p, *ps]):
            if p == "*":
                return [patch(element, value, ps) for element in j]
            else:
                index = int(p)
                return j[:index] + [patch(j[index], value, ps)] + j[index + 1 :]
        # case: `path` is empty (i.e., the data structure to patch has been reached)
        case (_, _, []):
            return value
        # case: `path` is non-empty and `j` is of a non-"container" type
        case _:
            return j


def main():
    args = parse_args(sys.argv[1:])

    def _post():
        payload: Json = args.payload_to_post

        if args.patch_path_for_payload_to_post is not None:
            payload = patch(
                args.payload_to_post,
                value=args.patch_value_for_payload_to_post,
                path=args.patch_path_for_payload_to_post,
            )

        response = post(
            url=args.url_to_post,
            data=json.dumps(payload).encode(),
        )
        return dig(response, path=args.post_response_return_value_path)

    result: Json

    try:
        get_response = get(args.url_to_get)
        get_response_value = dig(get_response, path=args.get_response_check_path)
    except (DigError, IndexError, KeyError):
        result = _post()
    else:
        if get_response_value != args.get_response_failed_value:
            result = dig(get_response, path=args.get_response_return_value_path)
        else:
            result = _post()

    if isinstance(result, str):
        print(result)
    else:
        print(json.dumps(result))


if __name__ == "__main__":
    main()
