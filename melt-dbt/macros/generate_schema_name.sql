{% macro generate_schema_name(custom_schema_name, node) -%}
    {%- if target.name == "production" -%} {{ target.schema }}
    {%- elif custom_schema_name is none -%} {{ target.schema }}
    {%- else -%} {{ target.schema }}_{{ custom_schema_name | trim }}
    {%- endif -%}
{%- endmacro %}
