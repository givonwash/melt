with
    products as (select * from {{ ref("src_faker__products") }}),

    final as (
        select
            id::int8 as product_id,

            created_at::timestamp,
            created_at::timestamptz as created_at_with_tz,
            make::varchar as product_make,
            model::varchar as product_model,
            price::numeric(38, 9) as product_price,
            updated_at::timestamp,
            updated_at::timestamptz as updated_at_with_tz,
            year::int8 as product_year
        from products
    )

select *
from final
