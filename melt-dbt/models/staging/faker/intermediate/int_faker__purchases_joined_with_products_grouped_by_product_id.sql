with
    purchases as (select * from {{ ref("int_faker__purchases_joined_with_products") }}),

    final as (
        select
            product_id,

            count(added_to_cart_at) as count_cart_additions,
            count(purchased_at) as count_completed_purchases,
            count(returned_at) as count_returns,

            min(added_to_cart_at) as first_added_to_cart_at,
            min(purchased_at) as first_purchased_at,
            min(returned_at) as first_returned_at,
            min(carted_to_purchased_seconds) as shortest_carted_to_purchase_seconds,
            min(
                purchased_to_returned_seconds
            ) as shortest_purchased_to_returned_seconds,

            max(added_to_cart_at) as last_added_to_cart_at,
            max(purchased_at) as last_purchased_at,
            max(returned_at) as last_returned_at,
            max(carted_to_purchased_seconds) as longest_carted_to_purchased_seconds,
            max(purchased_to_returned_seconds) as longest_purchased_to_returned_seconds
        from purchases
        group by 1
    )

select *
from final
