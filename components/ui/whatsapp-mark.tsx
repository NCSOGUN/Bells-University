/** The WhatsApp logo in its own brand green. Decorative: always shown next to the word. */
export function WhatsAppMark({ className = "size-6" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 32 32" className={`shrink-0 ${className}`}>
      <path fill="#25D366" d="M16 2.9A13 13 0 0 0 4.8 22.6L3 29.1l6.7-1.8A13 13 0 1 0 16 2.9Z" />
      <path
        fill="#fff"
        d="M23.2 19.4c-.4-.2-2.3-1.1-2.6-1.3-.4-.1-.6-.2-.9.2l-1.2 1.5c-.2.3-.4.3-.8.1a10.7 10.7 0 0 1-5.3-4.6c-.4-.7.4-.6 1.1-2.1.1-.3 0-.5 0-.7l-1.2-2.8c-.3-.7-.6-.6-.9-.6h-.7c-.3 0-.7.1-1 .5-.4.4-1.4 1.3-1.4 3.2s1.4 3.8 1.6 4c.2.3 2.8 4.2 6.7 5.9 2.5 1.1 3.5 1.2 4.7 1 .8-.1 2.3-.9 2.6-1.8.3-.9.3-1.7.2-1.8l-.8-.4Z"
      />
    </svg>
  );
}
