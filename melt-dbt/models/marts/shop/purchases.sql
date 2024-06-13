with final as (select * from {{ ref("int_faker__purchases_joined_with_products") }})

select *
from final
