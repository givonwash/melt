# `melt-infra`

Logic for generating ("synthesizing") Kubernetes manifests to stand up [Airbyte](https://airbyte.com/), a [Postgres](https://www.postgresql.org/) database/service, and [Argo Workflows](https://argoproj.github.io/workflows/) with a [`CronWorkflow`](https://argo-workflows.readthedocs.io/en/stable/cron-workflows/) that handles the touted "end-to-end ELT pipeline" from which the `melt` namesake is derived.

## Synthesization

As a casual peruser of this repository might notice, there are no actual Kubernetes manifests "checked in" to `melt-infra` (or anywhere in `melt`). The reason for that being that this project makes use of a fully-deterministic compilation step ("synthesization") — with the help of [`cdk8s`](https://cdk8s.io/) — which allows for "Kubernetes manifests" to be more expressively defined via a programming language like TypeScript.

Why take this approach? The largest reason to define "manifests" (in this repo) with a statically typed programming language, like TypeScript, is that developers gain the ability to define constraints and check for their satisfaction _while working on the "manifests" themself_. Counterpose this to a scenario where developers have to handcraft JSON/YAML manifests, and even worse make use of Go's templating language, without having access to something akin to the [TypeScript language server](https://github.com/typescript-language-server/typescript-language-server) to check for type-correctness, simple logic errors, etc.

To see what the generated Kubernetes manifests look like, invoke `melt-infra`'s synthesization entrypoint like so:

```sh
# Step 1: Generate manifests
#
# NOTE:
#   1. Alternatively these options can be defined as environment variables instead to protect secret
#      credentials
#   2. To see descriptions for these options, execute `npx tsx src/synth.ts --help`
npx tsx src/synth.ts --airbyte-namespace '<airbyte-namespace>' \
                     --airbyte-server-url '<airbyte-server-url>' \
                     --argo-namespace '<argo-namespace>' \
                     --postgres-namespace '<postgres-namespace>' \
                     --postgres-database '<postgres-database>' \
                     --postgres-admin-password '<postgres-admin-password>' \
                     --postgres-melt-user '<postgres-melt-user>' \
                     --postgres-melt-password '<postgres-melt-password>'

# Step 2: Inspect the contents of the (potentially) newly created `dist/` directory to see the
#         generated manifests
less dist/*.yaml
```
