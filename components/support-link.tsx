import Link from "next/link";

type SupportLinkProps = {
  text: string;
  linkText: string;
};

export function SupportLink({ text, linkText }: SupportLinkProps) {
  return (
    <p className="text-gray-500 text-xs">
      {text}{" "}
      <Link className="hover:underline" href="/legal/support">
        {linkText}
      </Link>
    </p>
  );
}
