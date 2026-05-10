import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#0b1220" },
          headerTintColor: "#e2e8f0",
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: "#0a0e1a" },
        }}
      >
        <Stack.Screen name="index" options={{ title: "JSON Tool · Jobs" }} />
        <Stack.Screen name="new" options={{ title: "New Job" }} />
        <Stack.Screen name="jobs/[id]" options={{ title: "Job" }} />
      </Stack>
    </>
  );
}
