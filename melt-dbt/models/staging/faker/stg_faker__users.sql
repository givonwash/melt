with
    users as (select * from {{ ref("src_faker__users") }}),

    final as (
        select
            id::int8 as user_id,

            academic_degree::varchar as user_academic_degree,
            age::int8 as user_age,
            blood_type::t_blood_type as user_blood_type,
            created_at::timestamp,
            created_at::timestamptz as created_at_with_tz,
            email::varchar as user_email_address,
            gender::varchar as user_gender,
            height::float as user_height,
            language::varchar as user_language,
            name::varchar as user_name,
            nationality::varchar as user_nationality,
            occupation::varchar as user_occupation,
            telephone::varchar as user_phone_number,
            title::varchar as user_title,
            updated_at::timestamp,
            updated_at::timestamptz as updated_at_with_tz,
            weight::int8 as user_weight,

            (address ->> 'city')::varchar as user_city,
            (address ->> 'country_code')::varchar as user_country_code,
            (address ->> 'postal_code')::int as user_postal_code,
            (address ->> 'province')::varchar as user_province,
            (address ->> 'state')::varchar as user_state,
            (address ->> 'street_name')::varchar as user_street_name,
            (address ->> 'street_number')::int8 as user_street_number
        from users
    )

select *
from final
