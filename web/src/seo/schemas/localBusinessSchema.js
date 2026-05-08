/**
 * LocalBusiness — re-export of the canonical LOCAL_BUSINESS_SCHEMA from siteSeo
 * so callers can import the schema like every other builder while siteSeo
 * remains the single source of truth for the address + coordinates.
 */
export { LOCAL_BUSINESS_SCHEMA as localBusinessSchema } from "../siteSeo"
