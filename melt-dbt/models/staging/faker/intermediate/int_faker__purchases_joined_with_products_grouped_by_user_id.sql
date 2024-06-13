with
    purchases as (select * from {{ ref("int_faker__purchases_joined_with_products") }}),

    user_product_purchases as (
        select
            user_id,
            product_id,

            count(added_to_cart_at) as count_cart_additions,
            count(purchased_at) as count_completed_purchases,
            count(returned_at) as count_returns
        from purchases
        group by 1, 2
    ),

    user_product_purchase_metrics as (
        select
            user_id,

            first_value(product_id) over (
                partition by user_id order by count_cart_additions desc
            ) as most_carted_product,

            first_value(product_id) over (
                partition by user_id order by count_completed_purchases desc
            ) as most_purchased_product,

            first_value(product_id) over (
                partition by user_id order by count_returns desc
            ) as most_returned_product,

            ((row_number() over (partition by user_id)) = 1) as _deduplication_flag
        from user_product_purchases
    ),

    final as (
        select
            purchases.user_id,

            user_product_purchase_metrics.most_carted_product,
            user_product_purchase_metrics.most_purchased_product,
            user_product_purchase_metrics.most_returned_product,

            count(purchases.added_to_cart_at) as count_cart_additions,
            count(purchases.purchased_at) as count_completed_purchases,
            count(purchases.returned_at) as count_returns,

            min(purchases.added_to_cart_at) as first_added_to_cart_at,
            min(purchases.purchased_at) as first_purchased_at,
            min(purchases.returned_at) as first_returned_at,
            min(
                purchases.carted_to_purchased_seconds
            ) as shortest_carted_to_purchase_seconds,
            min(
                purchases.purchased_to_returned_seconds
            ) as shortest_purchased_to_returned_seconds,

            max(purchases.added_to_cart_at) as last_added_to_cart_at,
            max(purchases.purchased_at) as last_purchased_at,
            max(purchases.returned_at) as last_returned_at,
            max(
                purchases.carted_to_purchased_seconds
            ) as longest_carted_to_purchased_seconds,
            max(
                purchases.purchased_to_returned_seconds
            ) as longest_purchased_to_returned_seconds
        from purchases
        left join
            user_product_purchase_metrics
            on (
                purchases.user_id = user_product_purchase_metrics.user_id
                and user_product_purchase_metrics._deduplication_flag
            )
            {{ dbt_utils.group_by(n=4) }}
    )

select *
from final
