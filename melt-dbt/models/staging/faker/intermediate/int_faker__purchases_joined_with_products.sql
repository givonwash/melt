with
    purchases as (select * from {{ ref("stg_faker__purchases") }}),

    products as (select * from {{ ref("stg_faker__products") }}),

    final as (
        select
            {{
                dbt_utils.star(
                    from=ref("stg_faker__products"),
                    relation_alias="products",
                    except=[
                        "created_at",
                        "created_at_with_tz",
                        "updated_at",
                        "updated_at_with_tz",
                    ],
                )
            }},

            products.created_at as product_created_at,
            products.created_at_with_tz as product_created_at_with_tz,
            products.updated_at as product_updated_at,
            products.updated_at_with_tz as product_updated_at_with_tz,

            {{
                dbt_utils.star(
                    from=ref("stg_faker__purchases"),
                    except=[
                        "product_id",
                        "created_at",
                        "created_at_with_tz",
                        "updated_at",
                        "updated_at_with_tz",
                    ],
                )
            }},

            purchases.created_at as purchase_created_at,
            purchases.created_at_with_tz as purchase_created_at_with_tz,
            purchases.updated_at as purchase_updated_at,
            purchases.updated_at_with_tz as purchase_updated_at_with_tz
        from purchases
        join products on purchases.product_id = products.product_id
    )

select *
from final
