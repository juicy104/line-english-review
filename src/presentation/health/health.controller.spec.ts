import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns ok status', () => {
    const controller = new HealthController();

    expect(controller.getHealth()).toEqual({ status: 'ok' });
  });

  it('returns ok status for root health', () => {
    const controller = new HealthController();

    expect(controller.getRootHealth()).toEqual({ status: 'ok' });
  });
});
