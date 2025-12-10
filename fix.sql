UPDATE DailyGuest
  SET startDate = COALESCE(startDate, datetime(strftime('%Y-%m-%d', createdAt) || ' 00:00:00')),
      endDate   = COALESCE(endDate,   datetime(strftime('%Y-%m-%d', createdAt) || ' 23:59:59'))
WHERE startDate IS NULL OR endDate IS NULL;
