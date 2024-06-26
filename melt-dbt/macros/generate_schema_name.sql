{% macro generate_schema_name(custom_schema_name, node) -%}
    {%- if target.name == "production" and custom_schema_name is not none -%}
        {{ custom_schema_name }}
    {% elif custom_schema_name is none %} {{ target.schema }}_{{ target.user }}
    {%- else -%} {{ target.schema }}_{{ target.user }}_{{ custom_schema_name | trim }}
    {%- endif -%}
{%- endmacro %}
