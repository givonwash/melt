with final as (select * from {{ source("faker", "purchases") }}) select * from final
