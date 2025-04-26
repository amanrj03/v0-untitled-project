"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Plus, Trash2 } from "lucide-react"
import { createTest } from "@/lib/teacher"

const questionTypes = [
  { value: "SINGLE_CHOICE", label: "Single Choice" },
  { value: "MULTIPLE_CHOICE", label: "Multiple Choice" },
  { value: "NUMERICAL", label: "Numerical Answer" },
  { value: "MATRIX_MATCH", label: "Matrix Match" },
]

const subjects = [
  { value: "PHYSICS", label: "Physics" },
  { value: "CHEMISTRY", label: "Chemistry" },
  { value: "MATHEMATICS", label: "Mathematics" },
]

interface Question {
  id: string
  type: string
  text: string
  options: { id: string; text: string; isCorrect: boolean }[]
  correctAnswer?: string
  marks: { correct: number; incorrect: number }
}

export default function CreateTest() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("details")
  const [testDetails, setTestDetails] = useState({
    title: "",
    description: "",
    subject: "",
    duration: 180,
    instructions: "",
    passingMarks: 0,
  })
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentQuestion, setCurrentQuestion] = useState<Question>({
    id: crypto.randomUUID(),
    type: "SINGLE_CHOICE",
    text: "",
    options: [
      { id: crypto.randomUUID(), text: "", isCorrect: false },
      { id: crypto.randomUUID(), text: "", isCorrect: false },
      { id: crypto.randomUUID(), text: "", isCorrect: false },
      { id: crypto.randomUUID(), text: "", isCorrect: false },
    ],
    marks: { correct: 4, incorrect: -1 },
  })

  const handleDetailsChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setTestDetails((prev) => ({
      ...prev,
      [name]: name === "duration" || name === "passingMarks" ? Number.parseInt(value) : value,
    }))
  }

  const handleQuestionTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCurrentQuestion((prev) => ({ ...prev, text: e.target.value }))
  }

  const handleQuestionTypeChange = (value: string) => {
    setCurrentQuestion((prev) => {
      // Reset options based on question type
      let options = prev.options
      if (value === "NUMERICAL") {
        options = []
      } else if (value === "SINGLE_CHOICE" || value === "MULTIPLE_CHOICE") {
        if (options.length === 0) {
          options = [
            { id: crypto.randomUUID(), text: "", isCorrect: false },
            { id: crypto.randomUUID(), text: "", isCorrect: false },
            { id: crypto.randomUUID(), text: "", isCorrect: false },
            { id: crypto.randomUUID(), text: "", isCorrect: false },
          ]
        }
      } else if (value === "MATRIX_MATCH") {
        options = [
          { id: crypto.randomUUID(), text: "Row 1", isCorrect: false },
          { id: crypto.randomUUID(), text: "Row 2", isCorrect: false },
          { id: crypto.randomUUID(), text: "Row 3", isCorrect: false },
          { id: crypto.randomUUID(), text: "Row 4", isCorrect: false },
        ]
      }

      return { ...prev, type: value, options }
    })
  }

  const handleOptionChange = (id: string, value: string) => {
    setCurrentQuestion((prev) => ({
      ...prev,
      options: prev.options.map((opt) => (opt.id === id ? { ...opt, text: value } : opt)),
    }))
  }

  const handleCorrectOptionChange = (id: string) => {
    if (currentQuestion.type === "SINGLE_CHOICE") {
      setCurrentQuestion((prev) => ({
        ...prev,
        options: prev.options.map((opt) => ({ ...opt, isCorrect: opt.id === id })),
      }))
    } else if (currentQuestion.type === "MULTIPLE_CHOICE") {
      setCurrentQuestion((prev) => ({
        ...prev,
        options: prev.options.map((opt) => (opt.id === id ? { ...opt, isCorrect: !opt.isCorrect } : opt)),
      }))
    }
  }

  const handleNumericalAnswerChange = (value: string) => {
    setCurrentQuestion((prev) => ({ ...prev, correctAnswer: value }))
  }

  const handleMarksChange = (type: "correct" | "incorrect", value: string) => {
    setCurrentQuestion((prev) => ({
      ...prev,
      marks: { ...prev.marks, [type]: Number.parseFloat(value) },
    }))
  }

  const addOption = () => {
    setCurrentQuestion((prev) => ({
      ...prev,
      options: [...prev.options, { id: crypto.randomUUID(), text: "", isCorrect: false }],
    }))
  }

  const removeOption = (id: string) => {
    setCurrentQuestion((prev) => ({
      ...prev,
      options: prev.options.filter((opt) => opt.id !== id),
    }))
  }

  const addQuestion = () => {
    setQuestions((prev) => [...prev, currentQuestion])
    setCurrentQuestion({
      id: crypto.randomUUID(),
      type: "SINGLE_CHOICE",
      text: "",
      options: [
        { id: crypto.randomUUID(), text: "", isCorrect: false },
        { id: crypto.randomUUID(), text: "", isCorrect: false },
        { id: crypto.randomUUID(), text: "", isCorrect: false },
        { id: crypto.randomUUID(), text: "", isCorrect: false },
      ],
      marks: { correct: 4, incorrect: -1 },
    })
  }

  const editQuestion = (id: string) => {
    const question = questions.find((q) => q.id === id)
    if (question) {
      setCurrentQuestion(question)
      setQuestions((prev) => prev.filter((q) => q.id !== id))
    }
  }

  const removeQuestion = (id: string) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id))
  }

  const handleSubmit = async (status: "DRAFT" | "ACTIVE") => {
    if (!testDetails.title || !testDetails.subject || questions.length === 0) {
      alert("Please fill in all required fields and add at least one question")
      return
    }

    setIsLoading(true)
    try {
      const result = await createTest({
        ...testDetails,
        questions,
        status,
      })

      if (result.success) {
        router.push(`/teacher/tests/${result.testId}`)
      } else {
        alert(result.error || "Failed to create test")
      }
    } catch (error) {
      console.error("Error creating test:", error)
      alert("An error occurred while creating the test")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b bg-background">
        <div className="container flex h-16 items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <Link href="/teacher/dashboard" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Dashboard</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" disabled={isLoading} onClick={() => handleSubmit("DRAFT")}>
              Save as Draft
            </Button>
            <Button disabled={isLoading} onClick={() => handleSubmit("ACTIVE")}>
              {isLoading ? "Creating..." : "Publish Test"}
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1 container py-6">
        <h1 className="text-3xl font-bold mb-6">Create New Test</h1>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Test Details</TabsTrigger>
            <TabsTrigger value="questions">Questions ({questions.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="details" className="space-y-4 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Test Information</CardTitle>
                <CardDescription>Enter the basic details for your test</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Test Title*</Label>
                    <Input
                      id="title"
                      name="title"
                      value={testDetails.title}
                      onChange={handleDetailsChange}
                      placeholder="e.g., JEE Advanced Physics Mock Test"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subject">Subject*</Label>
                    <Select
                      value={testDetails.subject}
                      onValueChange={(value) => setTestDetails((prev) => ({ ...prev, subject: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {subjects.map((subject) => (
                          <SelectItem key={subject.value} value={subject.value}>
                            {subject.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="duration">Duration (minutes)*</Label>
                    <Input
                      id="duration"
                      name="duration"
                      type="number"
                      value={testDetails.duration}
                      onChange={handleDetailsChange}
                      min={1}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="passingMarks">Passing Marks</Label>
                    <Input
                      id="passingMarks"
                      name="passingMarks"
                      type="number"
                      value={testDetails.passingMarks}
                      onChange={handleDetailsChange}
                      min={0}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    value={testDetails.description}
                    onChange={handleDetailsChange}
                    placeholder="Brief description of the test"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instructions">Instructions</Label>
                  <Textarea
                    id="instructions"
                    name="instructions"
                    value={testDetails.instructions}
                    onChange={handleDetailsChange}
                    placeholder="Instructions for students taking the test"
                    rows={5}
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={() => setActiveTab("questions")}>Continue to Questions</Button>
              </CardFooter>
            </Card>
          </TabsContent>
          <TabsContent value="questions" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Add Question</CardTitle>
                <CardDescription>Create a new question for your test</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="questionType">Question Type</Label>
                  <Select value={currentQuestion.type} onValueChange={handleQuestionTypeChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select question type" />
                    </SelectTrigger>
                    <SelectContent>
                      {questionTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="questionText">Question Text*</Label>
                  <Textarea
                    id="questionText"
                    value={currentQuestion.text}
                    onChange={handleQuestionTextChange}
                    placeholder="Enter your question here"
                    rows={4}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="correctMarks">Marks for Correct Answer</Label>
                    <Input
                      id="correctMarks"
                      type="number"
                      value={currentQuestion.marks.correct}
                      onChange={(e) => handleMarksChange("correct", e.target.value)}
                      min={0}
                      step={0.5}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="incorrectMarks">Negative Marks (if any)</Label>
                    <Input
                      id="incorrectMarks"
                      type="number"
                      value={currentQuestion.marks.incorrect}
                      onChange={(e) => handleMarksChange("incorrect", e.target.value)}
                      max={0}
                      step={0.5}
                    />
                  </div>
                </div>

                {(currentQuestion.type === "SINGLE_CHOICE" || currentQuestion.type === "MULTIPLE_CHOICE") && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Options</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addOption}>
                        <Plus className="h-4 w-4 mr-2" /> Add Option
                      </Button>
                    </div>
                    {currentQuestion.options.map((option, index) => (
                      <div key={option.id} className="flex items-center gap-2">
                        <div className="flex-1">
                          <Input
                            value={option.text}
                            onChange={(e) => handleOptionChange(option.id, e.target.value)}
                            placeholder={`Option ${index + 1}`}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type={currentQuestion.type === "SINGLE_CHOICE" ? "radio" : "checkbox"}
                            checked={option.isCorrect}
                            onChange={() => handleCorrectOptionChange(option.id)}
                            className="h-4 w-4"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeOption(option.id)}
                            disabled={currentQuestion.options.length <= 2}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {currentQuestion.type === "NUMERICAL" && (
                  <div className="space-y-2">
                    <Label htmlFor="numericalAnswer">Correct Answer</Label>
                    <Input
                      id="numericalAnswer"
                      value={currentQuestion.correctAnswer || ""}
                      onChange={(e) => handleNumericalAnswerChange(e.target.value)}
                      placeholder="e.g., 9.8 or 3.14"
                    />
                  </div>
                )}

                {currentQuestion.type === "MATRIX_MATCH" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Column A (Statements)</Label>
                        {currentQuestion.options.slice(0, 4).map((option, index) => (
                          <Input
                            key={option.id}
                            value={option.text}
                            onChange={(e) => handleOptionChange(option.id, e.target.value)}
                            placeholder={`Statement ${index + 1}`}
                            className="mb-2"
                          />
                        ))}
                      </div>
                      <div className="space-y-2">
                        <Label>Column B (Matches)</Label>
                        {currentQuestion.options.slice(0, 4).map((option, index) => (
                          <Input
                            key={`match-${option.id}`}
                            value={option.isCorrect ? String(index + 1) : ""}
                            onChange={(e) => {
                              const updatedOptions = [...currentQuestion.options]
                              updatedOptions[index] = {
                                ...updatedOptions[index],
                                isCorrect: e.target.value !== "",
                              }
                              setCurrentQuestion((prev) => ({ ...prev, options: updatedOptions }))
                            }}
                            placeholder={`Match for ${index + 1}`}
                            className="mb-2"
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" onClick={() => setActiveTab("details")}>
                  Back to Details
                </Button>
                <Button onClick={addQuestion} disabled={!currentQuestion.text}>
                  Add Question
                </Button>
              </CardFooter>
            </Card>

            {questions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Added Questions ({questions.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {questions.map((question, index) => (
                      <div key={question.id} className="border rounded-md p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div className="font-medium">Question {index + 1}</div>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => editQuestion(question.id)}>
                              Edit
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => removeQuestion(question.id)}>
                              Remove
                            </Button>
                          </div>
                        </div>
                        <div className="mb-2">{question.text}</div>
                        <div className="text-sm text-muted-foreground">
                          {questionTypes.find((t) => t.value === question.type)?.label} •{question.marks.correct} marks
                          •{question.marks.incorrect !== 0 && ` ${question.marks.incorrect} negative marks`}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
