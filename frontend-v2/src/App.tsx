import "./App.css";
import { ModeToggle } from "./components/mode-toggle";
import { Button } from "./components/ui/button";
import { Checkbox } from "./components/ui/checkbox";

function App() {
  return (
    <div className="items-top flex space-x-2">
      <Button variant="default">Default</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
      <Checkbox id="checkbox-1" />
      <div className="flex items-center space-x-2">
        <Checkbox id="checkbox-2" />
        <label
          htmlFor="checkbox-2"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Checkbox
        </label>
        <ModeToggle />
      </div>
    </div>
  );
}

export default App;
