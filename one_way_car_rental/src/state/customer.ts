// Export CustomerData context directly so unauthenticated guest users can browse the dashboard,
// while profile is null until authenticated via LoginModal or header.
export { useCustomerData, CustomerDataProvider } from '@core/context/CustomerData';
