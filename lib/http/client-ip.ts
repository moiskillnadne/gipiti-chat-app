import { isIP } from "node:net";

const FORWARDED_FOR_HEADER = "x-forwarded-for";
const REAL_IP_HEADER = "x-real-ip";

const IPV4 = 4;
const IPV6_GROUP_COUNT = 8;
/** Hextets of an IPv6 address that identify the network (a /64). */
const IPV6_NETWORK_GROUPS = 4;
const IPV4_MAPPED_PREFIX = /^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/i;

/**
 * The client's IP address as the platform reported it, or null when no header
 * carries a valid address (localhost without a proxy, unit tests).
 *
 * On Vercel `x-forwarded-for` is written by the platform and holds the
 * client's address; behind other proxies it is a comma-separated chain whose
 * first entry is the client. The value is used only as a rate-limit key, never
 * for an access decision.
 */
export const getClientIp = (headers: Headers): string | null => {
  const forwardedFor = headers.get(FORWARDED_FOR_HEADER)?.split(",")[0]?.trim();
  const candidate = forwardedFor || headers.get(REAL_IP_HEADER)?.trim();

  return candidate && isIP(candidate) !== 0 ? candidate : null;
};

/**
 * Expand the groups on one side of a `::`. An empty side has no groups.
 */
const groupsOf = (side: string): string[] => (side ? side.split(":") : []);

/**
 * The key to rate limit an address by.
 *
 * An IPv4 address is its own key. An IPv6 client usually owns a whole /64 and
 * can pick a new address inside it for every request, so IPv6 is keyed by its
 * network half (`2001:db8:1:2::/64`). An IPv4-mapped IPv6 address is keyed as
 * the IPv4 address it carries.
 *
 * @param ip - a valid IP address, as returned by `getClientIp`
 */
export const toRateLimitIpKey = (ip: string): string => {
  const address = ip.replace(IPV4_MAPPED_PREFIX, "");

  if (isIP(address) === IPV4) {
    return address;
  }

  const [head = "", tail] = address.toLowerCase().split("::");
  const headGroups = groupsOf(head);
  const tailGroups = tail === undefined ? [] : groupsOf(tail);
  const missingGroups =
    IPV6_GROUP_COUNT - headGroups.length - tailGroups.length;
  const groups = [
    ...headGroups,
    ...Array.from({ length: Math.max(missingGroups, 0) }, () => "0"),
    ...tailGroups,
  ];
  const network = groups
    .slice(0, IPV6_NETWORK_GROUPS)
    .map((group) => Number.parseInt(group, 16).toString(16));

  return `${network.join(":")}::/64`;
};
