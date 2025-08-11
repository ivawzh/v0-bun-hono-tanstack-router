import { useLogin, useSession } from "@/lib/auth-client";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import Loader from "./loader";
import { Button } from "./ui/button";

export default function SignInForm({
	onSwitchToSignUp,
}: {
	onSwitchToSignUp: () => void;
}) {
	const navigate = useNavigate({
		from: "/",
	});
	const { isLoading } = useSession();
	const { login, isPending } = useLogin();

	if (isLoading) {
		return <Loader />;
	}

	return (
		<div className="mx-auto w-full mt-10 max-w-md p-6">
			<h1 className="mb-6 text-center text-3xl font-bold">Welcome Back</h1>
			<p className="text-center text-gray-600 mb-6">
				Sign in with your Google account to continue
			</p>

			<Button
				onClick={() => login()}
				className="w-full"
				disabled={isPending}
			>
				{isPending ? "Redirecting..." : "Sign in with Google"}
			</Button>

			<div className="mt-4 text-center">
				<Button
					variant="link"
					onClick={onSwitchToSignUp}
					className="text-indigo-600 hover:text-indigo-800"
				>
					Need an account? Sign Up
				</Button>
			</div>
		</div>
	);
}
