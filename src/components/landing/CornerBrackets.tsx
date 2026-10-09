/** Four thin L-shaped corners framing the headline, like a viewfinder. They fade in once the page loads. */
export default function CornerBrackets() {
  const corner = "absolute h-12 w-12 border-[#14213d]/35 lp-rise";
  return (
    <div aria-hidden className="pointer-events-none absolute -inset-x-2 top-[3.2rem] bottom-[8.5rem] sm:-inset-x-8 md:-inset-x-14">
      <span className={`${corner} left-0 top-0 border-l-[1.5px] border-t-[1.5px]`} style={{ animationDelay: "0.4s" }} />
      <span className={`${corner} right-0 top-0 border-r-[1.5px] border-t-[1.5px]`} style={{ animationDelay: "0.5s" }} />
      <span className={`${corner} bottom-0 left-0 border-b-[1.5px] border-l-[1.5px]`} style={{ animationDelay: "0.6s" }} />
      <span className={`${corner} bottom-0 right-0 border-b-[1.5px] border-r-[1.5px]`} style={{ animationDelay: "0.7s" }} />
    </div>
  );
}
