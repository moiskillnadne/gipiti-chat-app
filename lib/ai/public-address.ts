import "server-only";

import { BlockList, isIP } from "node:net";

/**
 * Which IP addresses the server may open a connection to when the target was
 * named by someone else (see `remote-image-fetch.ts`): only publicly routable
 * ones. Loopback, private networks, link-local (which holds the cloud
 * metadata endpoint) and the other special-purpose ranges are refused.
 */

type Subnet = readonly [network: string, prefixLength: number];

const BLOCKED_IPV4_SUBNETS: readonly Subnet[] = [
  ["0.0.0.0", 8], // "this network" and the unspecified address
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, cloud metadata (169.254.169.254)
  ["172.16.0.0", 12], // private
  ["192.168.0.0", 16], // private
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved, broadcast
];

/**
 * IPv4-mapped addresses (`::ffff:a.b.c.d`) need no entry: `BlockList` checks
 * them against the IPv4 rules above. The other forms that carry an IPv4
 * address inside an IPv6 one are refused whole, since the IPv4 rules never
 * see the address they lead to.
 */
const BLOCKED_IPV6_SUBNETS: readonly Subnet[] = [
  ["::", 96], // unspecified (::), loopback (::1), IPv4-compatible (::a.b.c.d)
  ["64:ff9b::", 96], // NAT64
  ["2002::", 16], // 6to4
  ["fc00::", 7], // unique-local
  ["fe80::", 10], // link-local
  ["ff00::", 8], // multicast
];

const createBlockedAddressList = (): BlockList => {
  const blockList = new BlockList();
  for (const [network, prefixLength] of BLOCKED_IPV4_SUBNETS) {
    blockList.addSubnet(network, prefixLength, "ipv4");
  }
  for (const [network, prefixLength] of BLOCKED_IPV6_SUBNETS) {
    blockList.addSubnet(network, prefixLength, "ipv6");
  }
  return blockList;
};

const blockedAddresses = createBlockedAddressList();

/**
 * True when `address` is an IP address the server may connect to: not
 * loopback, private, link-local, or otherwise non-public. Anything that is
 * not an IP address at all is refused.
 */
export const isPublicAddress = (address: string): boolean => {
  const ipVersion = isIP(address);
  if (ipVersion === 0) {
    return false;
  }
  return !blockedAddresses.check(address, ipVersion === 6 ? "ipv6" : "ipv4");
};
