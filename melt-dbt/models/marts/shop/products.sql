with
    products as (select * from {{ ref("stg_faker__products") }}),

    product_purchase_metrics as (
        select *
        from
            {{ ref("int_faker__purchases_joined_with_products_grouped_by_product_id") }}
    ),

    final as (
        select
            {{
                dbt_utils.star(
                    from=ref("stg_faker__products"), relation_alias="products"
                )
            }},
            {{
                dbt_utils.star(
                    from=ref(
                        "int_faker__purchases_joined_with_products_grouped_by_product_id"
                    ),
                    except=["product_id"],
                )
            }}
        from products
        left join
            product_purchase_metrics
            on products.product_id = product_purchase_metrics.product_id
    )

select *
from final
