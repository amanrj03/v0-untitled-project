"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BookOpen, Clock } from "lucide-react"
import { getStudentDashboardData } from "@/lib/student"
import { checkAuth } from "@/lib/auth"

interface Test {
  id: string
  title: string
  subject: string
  duration: number
  totalQuestions: number
  createdAt: string
  status: string
  teacherName: string
}

interface TestResult {
  id: string
  testId: string
  testTitle: string
  subject: string
  score: number
  totalMarks: number
  completedAt: string
  status: string
}

export default function StudentDashboard() {
  const router = useRouter()
  const [availableTests, setAvailableTests] = useState<Test[]>([])
  const [completedTests, setCompletedTests] = useState<TestResult[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkUserAuth = async () => {
      const auth = await checkAuth()
      if (!auth.authenticated || auth.role !== "STUDENT") {
        router.push("/auth/login")
        return
      }

      try {
        const data = await getStudentDashboardData()
        setAvailableTests(data.availableTests)
        setCompletedTests(data.completedTests)
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error)
      } finally {
        setIsLoading(false)
      }
    }

    checkUserAuth()
  }, [router])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-2">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b bg-background">
        <div className="container flex h-16 items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <Link href="/student/dashboard" className="font-bold text-xl">
              TestPro
            </Link>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/student/profile">
              <Button variant="ghost" size="sm">
                Profile
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={() => router.push("/auth/logout")}>
              Logout
            </Button>
          </nav>
        </div>
      </header>
      <main className="flex-1 container py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Student Dashboard</h1>
        </div>

        <div className="grid gap-6 md:grid-cols-2 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available Tests</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{availableTests.length}</div>
              <p className="text-xs text-muted-foreground">
                {
                  availableTests.filter((t) => new Date(t.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
                    .length
                }{" "}
                new in last 7 days
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed Tests</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{completedTests.length}</div>
              <p className="text-xs text-muted-foreground">
                Average score:{" "}
                {completedTests.length > 0
                  ? Math.round(
                      completedTests.reduce((acc, test) => acc + (test.score / test.totalMarks) * 100, 0) /
                        completedTests.length,
                    )
                  : 0}
                %
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="available" className="w-full">
          <TabsList>
            <TabsTrigger value="available">Available Tests</TabsTrigger>
            <TabsTrigger value="completed">Completed Tests</TabsTrigger>
          </TabsList>
          <TabsContent value="available" className="space-y-4">
            {availableTests.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {availableTests.map((test) => (
                  <Card key={test.id}>
                    <CardHeader>
                      <CardTitle>{test.title}</CardTitle>
                      <CardDescription>{test.subject}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Duration:</span>
                          <span className="text-sm font-medium">{test.duration} minutes</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Questions:</span>
                          <span className="text-sm font-medium">{test.totalQuestions}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Teacher:</span>
                          <span className="text-sm font-medium">{test.teacherName}</span>
                        </div>
                      </div>
                    </CardContent>
                    <div className="p-4 pt-0">
                      <Link href={`/student/tests/${test.id}`}>
                        <Button className="w-full">Start Test</Button>
                      </Link>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <h3 className="text-lg font-medium">No tests available</h3>
                <p className="text-muted-foreground mt-1">Your teacher hasn't assigned any tests yet.</p>
              </div>
            )}
          </TabsContent>
          <TabsContent value="completed" className="space-y-4">
            {completedTests.length > 0 ? (
              <div className="rounded-md border">
                <div className="p-4">
                  <div className="grid grid-cols-5 font-medium">
                    <div>Test</div>
                    <div>Subject</div>
                    <div>Score</div>
                    <div>Completed On</div>
                    <div className="text-right">Actions</div>
                  </div>
                </div>
                <div className="divide-y">
                  {completedTests.map((result) => (
                    <div key={result.id} className="p-4">
                      <div className="grid grid-cols-5">
                        <div className="font-medium">{result.testTitle}</div>
                        <div>{result.subject}</div>
                        <div>
                          {result.score}/{result.totalMarks} ({Math.round((result.score / result.totalMarks) * 100)}%)
                        </div>
                        <div>{new Date(result.completedAt).toLocaleDateString()}</div>
                        <div className="flex justify-end">
                          <Link href={`/student/results/${result.id}`}>
                            <Button variant="ghost" size="sm">
                              View Results
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <h3 className="text-lg font-medium">No completed tests</h3>
                <p className="text-muted-foreground mt-1">You haven't completed any tests yet.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
