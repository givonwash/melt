with final as (select * from {{ source("faker", "products") }}) select * from final
