-- Insert the data from our temporary table into the new bots table
INSERT INTO bots (
    id,
    user_id,
    name,
    exchange,
    pair,
    max_position_size,
    stoploss_percentage,
    enabled,
    api_key,
    api_secret,
    created_at,
    updated_at
)
SELECT 
    id,
    user_id,
    name,
    exchange,
    pair,
    max_position_size,
    stoploss_percentage,
    enabled,
    COALESCE(api_key, ''), -- Use empty string if no API key exists
    COALESCE(api_secret, ''), -- Use empty string if no API secret exists
    created_at,
    updated_at
FROM temp_bots;

-- Drop the temporary table
DROP TABLE temp_bots;
