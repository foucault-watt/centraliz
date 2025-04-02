import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import {
  isRouteErrorResponse,
  useNavigate,
  useRouteError,
} from "react-router-dom";

export default function ErrorPage() {
  const error = useRouteError();
  const navigate = useNavigate();

  let errorMessage: string;
  let status: string | number = "";

  if (isRouteErrorResponse(error)) {
    status = error.status;
    errorMessage = error.data?.message || error.statusText;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === "string") {
    errorMessage = error;
  } else {
    errorMessage = "Une erreur inconnue s'est produite";
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
      <div className="w-full max-w-md mx-auto space-y-6">
        <Alert>
          {status && (
            <div className="text-7xl font-bold text-primary">{status}</div>
          )}
          <AlertTitle className="text-3xl font-bold tracking-tight">
            Oups !
          </AlertTitle>
          <AlertDescription className="text-muted-foreground">
            Désolé, une erreur s'est produite.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <h3 className="text-sm font-medium">Détails de l'erreur</h3>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground font-mono">
              {errorMessage}
            </p>
          </CardContent>
        </Card>

        <div className="flex flex-col space-y-2">
          <Button onClick={() => navigate("/")} variant="default">
            Retour à l'accueil
          </Button>
          <Button onClick={() => navigate(-1)} variant="outline">
            Retourner à la page précédente
          </Button>
        </div>
      </div>
    </div>
  );
}
