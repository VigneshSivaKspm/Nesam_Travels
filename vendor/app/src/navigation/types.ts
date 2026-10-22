import type { NavigatorScreenParams } from '@react-navigation/native';

/** `add` carries a timestamp so "Add …" from another screen opens the sheet every time, not only the first. */
export type TabParamList = {
  Duties: undefined;
  Drivers: { add?: number } | undefined;
  Vehicles: { add?: number } | undefined;
  Payouts: undefined;
  Account: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  Requests: undefined;
  Alerts: undefined;
  Penalties: undefined;
  Documents: undefined;
  Profile: undefined;
  Agreements: undefined;
};

declare global {
  // React Navigation's documented global typing hook.
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
