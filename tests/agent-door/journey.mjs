/** The owner can still inspect the real installation after the policy exercises. */
export default async function journey({ request, origin, cookie }) {
 const response = await request(new URL('/api/state', origin).href, { headers: { Cookie: cookie } })
 if (!response.ok) throw new Error('Native owner state is unavailable')
 const state = await response.json()
 if (!state || typeof state !== 'object') throw new Error('Native owner state is invalid')
}
