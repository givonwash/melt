with
    purchases as (select * from {{ ref("src_faker__purchases") }}),

    final as (
        select
            id::int8 as purchase_id,

            added_to_cart_at::timestamp,
            added_to_cart_at::timestamptz as added_to_cart_at_with_tz,
            created_at::timestamp,
            created_at::timestamptz as created_at_with_tz,
            product_id::int8,
            purchased_at::timestamp,
            purchased_at::timestamptz as purchased_at_with_tz,
            returned_at::timestamp,
            returned_at::timestamptz as returned_at_with_tz,
            updated_at::timestamp,
            updated_at::timestamptz as updated_at_with_tz,
            user_id::int8,

            extract(
                epoch from purchased_at - added_to_cart_at
            ) as carted_to_purchased_seconds,
            extract(
                epoch from returned_at - purchased_at
            ) as purchased_to_returned_seconds,

            case
                when returned_at >= purchased_at
                then 'Returned'::t_purchase_state
                when purchased_at >= added_to_cart_at
                then 'Purchased'::t_purchase_state
                when
                    (
                        added_to_cart_at is not null
                        and not coalesce(returned_at < purchased_at, false)
                        and not coalesce(purchased_at < added_to_cart_at, false)
                    )
                then 'InCart'::t_purchase_state
            end as purchase_state
        from purchases
    )

select *
from final
