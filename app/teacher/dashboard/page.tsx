"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BookOpen, Plus, Users } from "lucide-react"
import { getTeacherDashboardData } from "@/lib/teacher"
import { checkAuth } from "@/lib/auth"

interface Test {
  id: string
  title: string
  subject: string
  duration: number
  totalQuestions: number
  createdAt: string
  status: string
}

interface Student {
  id: string
  name: string
  email: string
  joinedAt: string
}

export default function TeacherDashboard() {
  const router = useRouter()
  const [tests, setTests] = useState<Test[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkUserAuth = async () => {
      const auth = await checkAuth()
      if (!auth.authenticated || auth.role !== "TEACHER") {
        router.push("/auth/login")
        return
      }

      try {
        const data = await getTeacherDashboardData()
        setTests(data.tests)
        setStudents(data.students)
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
            <Link href="/teacher/dashboard" className="font-bold text-xl">
              TestPro
            </Link>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/teacher/profile">
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
          <h1 className="text-3xl font-bold">Teacher Dashboard</h1>
          <div className="flex gap-2">
            <Link href="/teacher/tests/create">
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Create Test
              </Button>
            </Link>
            <Link href="/teacher/students/invite">
              <Button variant="outline" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Invite Students
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tests</CardTitle>
              <BookOpen className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tests.length}</div>
              <p className="text-xs text-muted-foreground">
                {tests.filter((t) => t.status === "ACTIVE").length} active tests
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Students</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{students.length}</div>
              <p className="text-xs text-muted-foreground">
                {students.filter((s) => new Date(s.joinedAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)).length}{" "}
                new in last 30 days
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                className="h-4 w-4 text-muted-foreground"
              >
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">78%</div>
              <p className="text-xs text-muted-foreground">+5.2% from last month</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="tests" className="w-full">
          <TabsList>
            <TabsTrigger value="tests">Tests</TabsTrigger>
            <TabsTrigger value="students">Students</TabsTrigger>
          </TabsList>
          <TabsContent value="tests" className="space-y-4">
            <div className="rounded-md border">
              <div className="p-4">
                <div className="grid grid-cols-6 font-medium">
                  <div>Title</div>
                  <div>Subject</div>
                  <div>Duration</div>
                  <div>Questions</div>
                  <div>Status</div>
                  <div className="text-right">Actions</div>
                </div>
              </div>
              <div className="divide-y">
                {tests.length > 0 ? (
                  tests.map((test) => (
                    <div key={test.id} className="p-4">
                      <div className="grid grid-cols-6">
                        <div className="font-medium">{test.title}</div>
                        <div>{test.subject}</div>
                        <div>{test.duration} min</div>
                        <div>{test.totalQuestions}</div>
                        <div>
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              test.status === "ACTIVE"
                                ? "bg-green-50 text-green-700"
                                : test.status === "DRAFT"
                                  ? "bg-yellow-50 text-yellow-700"
                                  : "bg-gray-50 text-gray-700"
                            }`}
                          >
                            {test.status}
                          </span>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Link href={`/teacher/tests/${test.id}`}>
                            <Button variant="ghost" size="sm">
                              View
                            </Button>
                          </Link>
                          <Link href={`/teacher/tests/${test.id}/edit`}>
                            <Button variant="ghost" size="sm">
                              Edit
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-muted-foreground">No tests created yet</div>
                )}
              </div>
            </div>
          </TabsContent>
          <TabsContent value="students" className="space-y-4">
            <div className="rounded-md border">
              <div className="p-4">
                <div className="grid grid-cols-4 font-medium">
                  <div>Name</div>
                  <div>Email</div>
                  <div>Joined</div>
                  <div className="text-right">Actions</div>
                </div>
              </div>
              <div className="divide-y">
                {students.length > 0 ? (
                  students.map((student) => (
                    <div key={student.id} className="p-4">
                      <div className="grid grid-cols-4">
                        <div className="font-medium">{student.name}</div>
                        <div>{student.email}</div>
                        <div>{new Date(student.joinedAt).toLocaleDateString()}</div>
                        <div className="flex justify-end gap-2">
                          <Link href={`/teacher/students/${student.id}`}>
                            <Button variant="ghost" size="sm">
                              View
                            </Button>
                          </Link>
                          <Button variant="ghost" size="sm">
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-muted-foreground">No students enrolled yet</div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
