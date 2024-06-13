with
    users as (select * from {{ ref("stg_faker__users") }}),

    user_purchase_metrics as (
        select *
        from {{ ref("int_faker__purchases_joined_with_products_grouped_by_user_id") }}
    ),

    final as (
        select
            {{ dbt_utils.star(from=ref("stg_faker__users"), relation_alias="users") }},
            {{
                dbt_utils.star(
                    from=ref(
                        "int_faker__purchases_joined_with_products_grouped_by_user_id"
                    ),
                    except=["user_id"],
                )
            }}
        from users
        left join user_purchase_metrics on users.user_id = user_purchase_metrics.user_id
    )

select *
from final
