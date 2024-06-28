-- fmt: off
-- NOTE: this model depends on the `products` model as `purchases.product_id` is a foreign key for
--       `products.product_id`
-- fmt: on
--
-- depends_on: {{ ref('products') }}
with final as (select * from {{ ref("int_faker__purchases_joined_with_products") }})

select *
from final
