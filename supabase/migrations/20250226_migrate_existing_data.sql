-- Create a temporary table to store the combined data
CREATE TEMP TABLE temp_bots AS
SELECT 
    b.id,
    b.user_id,
    b.name,
    ec.exchange,
    b.pair,
    b.max_position_size,
    b.stoploss_percentage,
    b.enabled,
    ec.api_key,
    ec.api_secret,
    b.created_at,
    b.updated_at
FROM bots b
LEFT JOIN exchange_config ec ON ec.user_id = b.user_id;

-- Drop the exchange_config table since we've merged it into bots
DROP TABLE IF EXISTS exchange_config;

-- Now we can safely apply the schema changes in the next migration
