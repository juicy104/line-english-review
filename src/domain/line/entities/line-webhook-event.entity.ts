export type LineWebhookEvent = {
  type: string;
  timestamp?: number;
  source?: {
    type: string;
    userId?: string;
    groupId?: string;
    roomId?: string;
  };
  replyToken?: string;
  mode?: string;
  webhookEventId?: string;
  deliveryContext?: {
    isRedelivery: boolean;
  };
  [key: string]: unknown;
};
