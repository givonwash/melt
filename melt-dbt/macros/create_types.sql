{% macro create_types() %}

    {{
        create_enum(
            name="t_blood_type",
            variants=["A+", "A−", "AB+", "AB−", "B+", "B−", "O+", "O−"],
        )
    }}

    {{
        create_enum(
            name="t_purchase_state", variants=["InCart", "Purchased", "Returned"]
        )
    }}

{% endmacro %}
