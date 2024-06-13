{% macro create_enum(name, variants) %}

do $$ begin
  create type {{ name }} as enum (
    {% for variant in variants %}
      {% if not loop.last %}
        '{{ variant }}',
      {% else %}
        '{{ variant }}'
      {% endif %}
    {% endfor %}
  );

  exception when duplicate_object then null;
end $$;

{% endmacro %}
