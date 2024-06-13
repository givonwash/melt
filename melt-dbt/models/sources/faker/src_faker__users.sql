with final as (select * from {{ source("faker", "users") }}) select * from final
