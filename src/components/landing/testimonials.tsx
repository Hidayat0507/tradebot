const testimonials = [
  {
    quote:
      'We went from a collection of fragile scripts to a unified automation stack in a weekend. Tradebot handles the operational plumbing so we can experiment with signals.',
    name: 'Maya Torres',
    role: 'Quant Lead, Apex Signals',
  },
  {
    quote:
      'Having bot limits, API key encryption, and webhook authentication out of the box is huge. It saves weeks of compliance review for each new strategy.',
    name: 'Leo Zhang',
    role: 'CTO, Hemlock Digital',
  },
  {
    quote:
      'The Pro plan paid for itself after the first deployment. Multiple desks can run their own bots without ops bottlenecks.',
    name: 'Priya Bhatt',
    role: 'Head of Trading, Delta Labs',
  },
]

export function Testimonials() {
  return (
    <section className="relative overflow-hidden py-24">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/15 via-purple-600/10 to-transparent" aria-hidden="true" />
      <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <span className="inline-block rounded-full bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-white">
            Trusted by trading teams
          </span>
          <h2 className="mt-6 text-3xl font-bold text-white sm:text-4xl">
            Built for the people who live and breathe quant execution.
          </h2>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((testimonial) => (
            <figure
              key={testimonial.name}
              className="rounded-3xl border border-white/20 bg-white/10 p-6 text-left shadow-xl backdrop-blur"
            >
              <blockquote className="text-sm leading-relaxed text-white/90">“{testimonial.quote}”</blockquote>
              <figcaption className="mt-6">
                <p className="text-sm font-semibold text-white">{testimonial.name}</p>
                <p className="text-xs text-white/70">{testimonial.role}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
