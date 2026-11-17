import "server-only";

import { BlockList, isIP } from "node:net";

/**
 * Which IP addresses the server may open a connection to when the target was
 * named by someone else (see `remote-image-fetch.ts`): only publicly routable
 * ones. Loopback, private networks, link-local (which holds the cloud
 * metadata endpoint) and the special-purpose ranges below are refused.
 *
 * The lists follow the IANA special-purpose address registries, minus the
 * entries that are ordinary public addresses in practice (anycast relays such
 * as 192.88.99.0/24). An address outside these lists is treated as public;
 * that includes address space nobody has been assigned yet.
 */

type Subnet = readonly [network: string, prefixLength: number];

const BLOCKED_IPV4_SUBNETS: readonly Subnet[] = [
  ["0.0.0.0", 8], // "this network" and the unspecified address
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, cloud metadata (169.254.169.254)
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // documentation (TEST-NET-1)
  ["192.168.0.0", 16], // private
  // Benchmarking. Also what a fake-IP proxy DNS on a developer machine
  // answers for every host, so behind such a proxy document images do not
  // load locally. That is accepted.
  ["198.18.0.0", 15],
  ["198.51.100.0", 24], // documentation (TEST-NET-2)
  ["203.0.113.0", 24], // documentation (TEST-NET-3)
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved, broadcast
];

/**
 * IPv4-mapped addresses (`::ffff:a.b.c.d`) have no entry: `BlockList` checks
 * them against the IPv4 rules above, so a mapped private address is refused
 * and a mapped public one is not. The other forms that carry an IPv4 address
 * inside an IPv6 one (IPv4-compatible, IPv4-translated, NAT64, 6to4, Teredo)
 * are refused whole, since the IPv4 rules never see the address they lead to.
 */
const BLOCKED_IPV6_SUBNETS: readonly Subnet[] = [
  ["::", 96], // unspecified (::), loopback (::1), IPv4-compatible (::a.b.c.d)
  ["::ffff:0:0:0", 96], // IPv4-translated (SIIT, ::ffff:0:a.b.c.d)
  ["64:ff9b::", 96], // NAT64
  ["100::", 64], // discard-only
  ["2001::", 23], // IETF special purpose, includes Teredo (2001::/32)
  ["2001:db8::", 32], // documentation
  ["2002::", 16], // 6to4
  ["fc00::", 7], // unique-local
  ["fe80::", 10], // link-local
  ["fec0::", 10], // site-local (deprecated)
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
