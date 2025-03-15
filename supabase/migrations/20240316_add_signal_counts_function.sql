-- Function to get signal counts by status for a specific user
CREATE OR REPLACE FUNCTION get_signal_counts_by_status(user_id_param UUID)
RETURNS TABLE (
  status TEXT,
  count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    signal_queue.status,
    COUNT(*)::BIGINT
  FROM
    signal_queue
  WHERE
    signal_queue.user_id = user_id_param
  GROUP BY
    signal_queue.status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 