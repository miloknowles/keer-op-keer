export const DEV_MULTI_SEAT =
  process.env.NODE_ENV === 'development' &&
  process.env.NEXT_PUBLIC_DEV_MULTI_SEAT === 'true';

export const DEV_ADMIN_BOARD =
  process.env.NODE_ENV === 'development' &&
  process.env.NEXT_PUBLIC_DEV_ADMIN_BOARD === 'true';
