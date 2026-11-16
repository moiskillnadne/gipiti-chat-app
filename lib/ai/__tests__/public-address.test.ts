import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { isPublicAddress } from "@/lib/ai/public-address";

describe("isPublicAddress", () => {
  it.each([
    ["a public IPv4 address", "93.184.216.34"],
    ["a public DNS resolver", "8.8.8.8"],
    ["just below 10/8", "9.255.255.255"],
    ["just above 10/8", "11.0.0.0"],
    ["just below CGNAT", "100.63.255.255"],
    ["just above CGNAT", "100.128.0.0"],
    ["just below link-local", "169.253.255.255"],
    ["just above link-local", "169.255.0.0"],
    ["just below 172.16/12", "172.15.255.255"],
    ["just above 172.16/12", "172.32.0.0"],
    ["just below 192.168/16", "192.167.255.255"],
    ["just above 192.168/16", "192.169.0.0"],
    ["the last unicast IPv4 address", "223.255.255.255"],
    ["a public IPv6 address", "2606:4700:4700::1111"],
    ["a public IPv4-mapped address", "::ffff:8.8.8.8"],
    ["a public IPv4-mapped address in hex", "::ffff:808:808"],
  ])("accepts %s (%s)", (_label, address) => {
    expect(isPublicAddress(address)).toBe(true);
  });

  it.each([
    ["the unspecified IPv4 address", "0.0.0.0"],
    ["this network", "0.1.2.3"],
    ["private 10/8", "10.0.0.1"],
    ["the end of 10/8", "10.255.255.255"],
    ["CGNAT", "100.64.0.1"],
    ["the end of CGNAT", "100.127.255.255"],
    ["loopback", "127.0.0.1"],
    ["the end of loopback", "127.255.255.254"],
    ["the cloud metadata address", "169.254.169.254"],
    ["link-local", "169.254.0.1"],
    ["private 172.16/12", "172.16.0.1"],
    ["the end of 172.16/12", "172.31.255.255"],
    ["private 192.168/16", "192.168.1.1"],
    ["multicast", "224.0.0.1"],
    ["the end of multicast", "239.255.255.255"],
    ["reserved", "240.0.0.1"],
    ["broadcast", "255.255.255.255"],
    ["the unspecified IPv6 address", "::"],
    ["IPv6 loopback", "::1"],
    ["IPv6 loopback written in full", "0:0:0:0:0:0:0:1"],
    ["unique-local fc00::/8", "fc00::1"],
    ["unique-local fd00::/8", "fd12:3456:789a::1"],
    ["IPv6 link-local", "fe80::1"],
    ["the end of IPv6 link-local", "febf::1"],
    ["IPv6 multicast", "ff02::1"],
    ["IPv4-mapped loopback", "::ffff:127.0.0.1"],
    ["IPv4-mapped loopback in hex", "::ffff:7f00:1"],
    ["IPv4-mapped unspecified", "::ffff:0.0.0.0"],
    ["IPv4-mapped private 10/8", "::ffff:10.0.0.1"],
    ["IPv4-mapped CGNAT", "::ffff:100.64.0.1"],
    ["IPv4-mapped metadata", "::ffff:169.254.169.254"],
    ["IPv4-mapped metadata in hex", "::ffff:a9fe:a9fe"],
    ["IPv4-mapped private 172.16/12", "::ffff:172.16.0.1"],
    ["IPv4-mapped private 192.168/16", "::ffff:192.168.0.1"],
    ["IPv4-mapped multicast", "::ffff:224.0.0.1"],
    ["IPv4-mapped reserved", "::ffff:240.0.0.1"],
    ["IPv4-compatible loopback", "::127.0.0.1"],
    ["NAT64 metadata", "64:ff9b::a9fe:a9fe"],
    ["6to4 metadata", "2002:a9fe:a9fe::1"],
    ["an empty string", ""],
    ["a hostname", "example.com"],
    ["an address with a port", "127.0.0.1:80"],
    ["a truncated address", "1.2.3"],
  ])("refuses %s (%s)", (_label, address) => {
    expect(isPublicAddress(address)).toBe(false);
  });
});
