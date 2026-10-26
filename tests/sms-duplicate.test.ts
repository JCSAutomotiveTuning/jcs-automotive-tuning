import { describe, expect, it, vi } from "vitest";

describe("SMS duplicate prevention", () => {
  it("does not resend after an uncertain delivery", async () => {
    const deliveries = new Map<string, string>();
    const sendSms = vi.fn().mockResolvedValue("SM_TEST_123");
    const key = "test-event:sms";

    async function processSms() {
      const prior = deliveries.get(key);

      if (prior) {
        return "needs_reconciliation";
      }

      deliveries.set(key, "sending");

      await sendSms("+447000000000", "Test notification");

      // Simulate Supabase failing to confirm the SMS.
      const confirmationFailed = true;

      if (confirmationFailed) {
        deliveries.set(key, "unknown");
        return "needs_reconciliation";
      }

      deliveries.set(key, "sent");
      return "sent";
    }

    expect(await processSms()).toBe("needs_reconciliation");
    expect(deliveries.get(key)).toBe("unknown");

    // Simulate a second worker attempt.
    expect(await processSms()).toBe("needs_reconciliation");

    // Twilio must only have been called once.
    expect(sendSms).toHaveBeenCalledTimes(1);
  });
});
