import CheckInForm from '@/components/CheckInForm'; 
import Link from 'next/link';

export default function Home() {
	return (
		<main className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 py-12 px-4">
			<div className="max-w-6xl mx-auto">
				<div className="text-center mb-12">
					<h1 className="text-4xl font-bold text-gray-900 mb-4">
						Anonymous Check-In System
					</h1>
					<p className="text-lg text-gray-600">
						Simple, secure, and anonymous check-in tracking
					</p>
				</div>

				<div className="grid md:grid-cols-2 gap-8 items-start">
					<CheckInForm />

					<div className="bg-white p-6 rounded-lg shadow-lg">
						<h2 className="text-2xl font-bold mb-4 text-gray-800">How It Works</h2>
						<div className="space-y-4">
							<div className="flex items-start gap-3">
								<div className="shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
									1
								</div>
								<div>
									<h3 className="font-semibold text-gray-900">Anonymous Identity</h3>
									<p className="text-sm text-gray-600">
										Generate a unique ID or let the system create one for you. No personal info required.
									</p>
								</div>
							</div>

							<div className="flex items-start gap-3">
								<div className="shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
									2
								</div>
								<div>
									<h3 className="font-semibold text-gray-900">Check In</h3>
									<p className="text-sm text-gray-600">
										Click the Check In button. Your ID is stored locally on your device.
									</p>
								</div>
							</div>

							<div className="flex items-start gap-3">
								<div className="shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
									3
								</div>
								<div>
									<h3 className="font-semibold text-gray-900">Check Out</h3>
									<p className="text-sm text-gray-600">
										When you&#39re done, click Check Out to update your status.
									</p>
								</div>
							</div>
						</div>

						<div className="mt-6 pt-6 border-t border-gray-200">
							<Link
								href="/dashboard"
								className="block text-center bg-gray-800 text-white py-2 px-4 rounded-md hover:bg-gray-900 transition-colors font-medium"
							>
								View Dashboard
							</Link>
						</div>
					</div>
				</div>

				<div className="mt-12 bg-white p-6 rounded-lg shadow-lg">
					<h2 className="text-xl font-bold mb-4 text-gray-800">Features</h2>
					<div className="grid md:grid-cols-3 gap-6">
						<div>
							<div className="text-blue-600 mb-2">
								<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
								</svg>
							</div>
							<h3 className="font-semibold text-gray-900 mb-2">Secure & Anonymous</h3>
							<p className="text-sm text-gray-600">
								No personal data collection. Your privacy is protected.
							</p>
						</div>

						<div>
							<div className="text-blue-600 mb-2">
								<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
								</svg>
							</div>
							<h3 className="font-semibold text-gray-900 mb-2">Responsive Design</h3>
							<p className="text-sm text-gray-600">
								Works seamlessly on any device - phone, tablet, or desktop.
							</p>
						</div>

						<div>
							<div className="text-blue-600 mb-2">
								<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
								</svg>
							</div>
							<h3 className="font-semibold text-gray-900 mb-2">Fast & Reliable</h3>
							<p className="text-sm text-gray-600">
								Built with modern tech for optimal performance.
							</p>
						</div>
					</div>
				</div>
			</div>
		</main>
	);
}