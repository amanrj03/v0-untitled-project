"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, ArrowLeft, ArrowRight, Clock, Flag } from "lucide-react"
import { getTestDetails, submitTestAnswers } from "@/lib/student"
import { checkAuth } from "@/lib/auth"

interface Question {
  id: string
  type: string
  text: string
  options: { id: string; text: string }[]
  marks: { correct: number; incorrect: number }
}

interface TestDetails {
  id: string
  title: string
  subject: string
  description: string
  instructions: string
  duration: number
  totalQuestions: number
  questions: Question[]
}

export default function TakeTest({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [test, setTest] = useState<TestDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<number>>(new Set())
  const [timeLeft, setTimeLeft] = useState<number>(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false)

  useEffect(() => {
    const checkUserAuth = async () => {
      const auth = await checkAuth()
      if (!auth.authenticated || auth.role !== "STUDENT") {
        router.push("/auth/login")
        return
      }

      try {
        const testData = await getTestDetails(params.id)
        setTest(testData)
        setTimeLeft(testData.duration * 60) // Convert minutes to seconds
      } catch (error) {
        console.error("Failed to fetch test details:", error)
        router.push("/student/dashboard")
      } finally {
        setIsLoading(false)
      }
    }

    checkUserAuth()
  }, [params.id, router])

  useEffect(() => {
    if (timeLeft <= 0 || !test) return

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          handleSubmitTest()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [timeLeft, test])

  if (isLoading || !test) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-2">Loading test...</p>
        </div>
      </div>
    )
  }

  const currentQuestion = test.questions[currentQuestionIndex]
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const handleAnswerChange = (questionId: string, value: string | string[]) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  const handleSingleChoiceChange = (questionId: string, optionId: string) => {
    handleAnswerChange(questionId, optionId)
  }

  const handleMultipleChoiceChange = (questionId: string, optionId: string) => {
    setAnswers((prev) => {
      const currentAnswers = (prev[questionId] as string[]) || []
      if (currentAnswers.includes(optionId)) {
        return { ...prev, [questionId]: currentAnswers.filter((id) => id !== optionId) }
      } else {
        return { ...prev, [questionId]: [...currentAnswers, optionId] }
      }
    })
  }

  const handleNumericalAnswerChange = (questionId: string, value: string) => {
    handleAnswerChange(questionId, value)
  }

  const handleFlagQuestion = () => {
    setFlaggedQuestions((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(currentQuestionIndex)) {
        newSet.delete(currentQuestionIndex)
      } else {
        newSet.add(currentQuestionIndex)
      }
      return newSet
    })
  }

  const goToNextQuestion = () => {
    if (currentQuestionIndex < test.questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1)
    }
  }

  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1)
    }
  }

  const goToQuestion = (index: number) => {
    setCurrentQuestionIndex(index)
  }

  const handleSubmitTest = async () => {
    if (showConfirmSubmit) {
      setIsSubmitting(true)
      try {
        const result = await submitTestAnswers(test.id, answers)
        if (result.success) {
          router.push(`/student/results/${result.resultId}`)
        } else {
          alert(result.error || "Failed to submit test")
        }
      } catch (error) {
        console.error("Error submitting test:", error)
        alert("An error occurred while submitting the test")
      } finally {
        setIsSubmitting(false)
      }
    } else {
      setShowConfirmSubmit(true)
    }
  }

  const cancelSubmit = () => {
    setShowConfirmSubmit(false)
  }

  const getAnsweredQuestionsCount = () => {
    return Object.keys(answers).length
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b bg-background">
        <div className="container flex h-16 items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xl">{test.title}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className={`font-medium ${timeLeft < 300 ? "text-red-500" : ""}`}>{formatTime(timeLeft)}</span>
            </div>
            <Button onClick={() => setShowConfirmSubmit(true)} disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit Test"}
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1 container py-6">
        {showConfirmSubmit ? (
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle>Confirm Submission</CardTitle>
              <CardDescription>
                Are you sure you want to submit your test? You won't be able to change your answers after submission.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Total Questions:</span>
                  <span>{test.questions.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Answered Questions:</span>
                  <span>{getAnsweredQuestionsCount()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Unanswered Questions:</span>
                  <span>{test.questions.length - getAnsweredQuestionsCount()}</span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={cancelSubmit}>
                Continue Test
              </Button>
              <Button onClick={handleSubmitTest} disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Confirm Submission"}
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>
                        Question {currentQuestionIndex + 1} of {test.questions.length}
                      </CardTitle>
                      <CardDescription>
                        {currentQuestion.marks.correct} marks{" "}
                        {currentQuestion.marks.incorrect !== 0 && `| ${currentQuestion.marks.incorrect} negative marks`}
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleFlagQuestion}
                      className={flaggedQuestions.has(currentQuestionIndex) ? "text-yellow-500" : ""}
                    >
                      <Flag className="h-4 w-4 mr-2" />
                      {flaggedQuestions.has(currentQuestionIndex) ? "Flagged" : "Flag for Review"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-lg">{currentQuestion.text}</div>

                  {currentQuestion.type === "SINGLE_CHOICE" && (
                    <div className="space-y-3">
                      {currentQuestion.options.map((option) => (
                        <div key={option.id} className="flex items-center space-x-2">
                          <input
                            type="radio"
                            id={option.id}
                            name={currentQuestion.id}
                            checked={(answers[currentQuestion.id] as string) === option.id}
                            onChange={() => handleSingleChoiceChange(currentQuestion.id, option.id)}
                            className="h-4 w-4"
                          />
                          <label
                            htmlFor={option.id}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {option.text}
                          </label>
                        </div>
                      ))}
                    </div>
                  )}

                  {currentQuestion.type === "MULTIPLE_CHOICE" && (
                    <div className="space-y-3">
                      {currentQuestion.options.map((option) => (
                        <div key={option.id} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={option.id}
                            checked={((answers[currentQuestion.id] as string[]) || []).includes(option.id)}
                            onChange={() => handleMultipleChoiceChange(currentQuestion.id, option.id)}
                            className="h-4 w-4"
                          />
                          <label
                            htmlFor={option.id}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {option.text}
                          </label>
                        </div>
                      ))}
                    </div>
                  )}

                  {currentQuestion.type === "NUMERICAL" && (
                    <div className="space-y-2">
                      <label htmlFor="numerical-answer" className="text-sm font-medium">
                        Enter your answer:
                      </label>
                      <input
                        id="numerical-answer"
                        type="text"
                        value={(answers[currentQuestion.id] as string) || ""}
                        onChange={(e) => handleNumericalAnswerChange(currentQuestion.id, e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder="Enter numerical value"
                      />
                    </div>
                  )}

                  {currentQuestion.type === "MATRIX_MATCH" && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h3 className="text-sm font-medium mb-2">Column A</h3>
                          {currentQuestion.options.slice(0, 4).map((option, index) => (
                            <div key={option.id} className="mb-2 p-2 border rounded-md">
                              {option.text}
                            </div>
                          ))}
                        </div>
                        <div>
                          <h3 className="text-sm font-medium mb-2">Column B</h3>
                          <div className="space-y-2">
                            {[1, 2, 3, 4].map((num) => (
                              <div key={num} className="flex items-center gap-2">
                                <span className="w-6 text-center">{num}.</span>
                                <select
                                  value={((answers[currentQuestion.id] as string[]) || [])[num - 1] || ""}
                                  onChange={(e) => {
                                    const value = e.target.value
                                    setAnswers((prev) => {
                                      const currentAnswers = [
                                        ...((prev[currentQuestion.id] as string[]) || Array(4).fill("")),
                                      ]
                                      currentAnswers[num - 1] = value
                                      return { ...prev, [currentQuestion.id]: currentAnswers }
                                    })
                                  }}
                                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <option value="">Select match</option>
                                  <option value="A">A</option>
                                  <option value="B">B</option>
                                  <option value="C">C</option>
                                  <option value="D">D</option>
                                </select>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="outline" onClick={goToPreviousQuestion} disabled={currentQuestionIndex === 0}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Previous
                  </Button>
                  <Button onClick={goToNextQuestion} disabled={currentQuestionIndex === test.questions.length - 1}>
                    Next
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardFooter>
              </Card>
            </div>
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Question Navigator</CardTitle>
                  <CardDescription>
                    {getAnsweredQuestionsCount()} of {test.questions.length} questions answered
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-5 gap-2">
                    {test.questions.map((_, index) => (
                      <Button
                        key={index}
                        variant={currentQuestionIndex === index ? "default" : "outline"}
                        size="sm"
                        className={`h-10 w-10 p-0 ${flaggedQuestions.has(index) ? "border-yellow-500 border-2" : ""} ${
                          answers[test.questions[index].id] ? "bg-green-50 text-green-700" : ""
                        }`}
                        onClick={() => goToQuestion(index)}
                      >
                        {index + 1}
                      </Button>
                    ))}
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-green-50 border border-green-700"></div>
                      <span className="text-sm">Answered</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-yellow-500"></div>
                      <span className="text-sm">Flagged for review</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border"></div>
                      <span className="text-sm">Not visited</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button className="w-full" onClick={() => setShowConfirmSubmit(true)}>
                    Submit Test
                  </Button>
                </CardFooter>
              </Card>
              {test.instructions && (
                <Card className="mt-4">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Instructions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm">{test.instructions}</div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
