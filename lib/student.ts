"use server"

import { revalidatePath } from "next/cache"
import prisma from "./db"
import { checkAuth } from "./auth"

// Student dashboard data
export async function getStudentDashboardData() {
  const auth = await checkAuth()

  if (!auth.authenticated || auth.role !== "STUDENT") {
    throw new Error("Unauthorized")
  }

  const studentId = auth.user.id

  // Get teachers
  const teacherRelations = await prisma.teacherStudent.findMany({
    where: {
      studentId,
    },
    select: {
      teacherId: true,
    },
  })

  const teacherIds = teacherRelations.map((rel) => rel.teacherId)

  // Get available tests
  const availableTests = await prisma.test.findMany({
    where: {
      teacherId: {
        in: teacherIds,
      },
      status: "ACTIVE",
    },
    include: {
      teacher: {
        select: {
          name: true,
        },
      },
      _count: {
        select: {
          questions: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  })

  // Get completed tests
  const completedTests = await prisma.testResult.findMany({
    where: {
      studentId,
    },
    include: {
      test: {
        select: {
          title: true,
          subject: true,
        },
      },
    },
    orderBy: {
      completedAt: "desc",
    },
  })

  return {
    availableTests: availableTests.map((test) => ({
      id: test.id,
      title: test.title,
      subject: test.subject,
      duration: test.duration,
      totalQuestions: test._count.questions,
      createdAt: test.createdAt.toISOString(),
      status: test.status,
      teacherName: test.teacher.name,
    })),
    completedTests: completedTests.map((result) => ({
      id: result.id,
      testId: result.testId,
      testTitle: result.test.title,
      subject: result.test.subject,
      score: result.score,
      totalMarks: result.totalMarks,
      completedAt: result.completedAt.toISOString(),
      status: result.status,
    })),
  }
}

// Get test details for student
export async function getTestDetails(testId: string) {
  const auth = await checkAuth()

  if (!auth.authenticated || auth.role !== "STUDENT") {
    throw new Error("Unauthorized")
  }

  const studentId = auth.user.id

  // Check if student has access to this test
  const teacherRelations = await prisma.teacherStudent.findMany({
    where: {
      studentId,
    },
    select: {
      teacherId: true,
    },
  })

  const teacherIds = teacherRelations.map((rel) => rel.teacherId)

  const test = await prisma.test.findFirst({
    where: {
      id: testId,
      teacherId: {
        in: teacherIds,
      },
      status: "ACTIVE",
    },
    include: {
      questions: {
        include: {
          options: {
            select: {
              id: true,
              text: true,
            },
          },
        },
      },
    },
  })

  if (!test) {
    throw new Error("Test not found or not available")
  }

  // Check if student has already taken this test
  const existingResult = await prisma.testResult.findFirst({
    where: {
      testId,
      studentId,
    },
  })

  if (existingResult) {
    throw new Error("You have already taken this test")
  }

  return {
    id: test.id,
    title: test.title,
    description: test.description,
    subject: test.subject,
    duration: test.duration,
    instructions: test.instructions,
    totalQuestions: test.questions.length,
    questions: test.questions.map((q) => ({
      id: q.id,
      type: q.type,
      text: q.text,
      marks: {
        correct: q.correctMarks,
        incorrect: q.incorrectMarks,
      },
      options: q.options,
    })),
  }
}

// Submit test answers
export async function submitTestAnswers(testId: string, answers: Record<string, string | string[]>) {
  const auth = await checkAuth()

  if (!auth.authenticated || auth.role !== "STUDENT") {
    throw new Error("Unauthorized")
  }

  const studentId = auth.user.id

  try {
    // Get test with questions and correct answers
    const test = await prisma.test.findUnique({
      where: {
        id: testId,
        status: "ACTIVE",
      },
      include: {
        questions: {
          include: {
            options: true,
          },
        },
      },
    })

    if (!test) {
      return { success: false, error: "Test not found" }
    }

    // Check if student has already taken this test
    const existingResult = await prisma.testResult.findFirst({
      where: {
        testId,
        studentId,
      },
    })

    if (existingResult) {
      return { success: false, error: "You have already taken this test" }
    }

    // Calculate score
    let score = 0
    let totalMarks = 0

    for (const question of test.questions) {
      totalMarks += question.correctMarks

      const studentAnswer = answers[question.id]

      if (!studentAnswer) continue // Skip unanswered questions

      let isCorrect = false

      switch (question.type) {
        case "SINGLE_CHOICE":
          // Find the correct option
          const correctOption = question.options.find((o) => o.isCorrect)
          isCorrect = correctOption ? studentAnswer === correctOption.id : false
          break

        case "MULTIPLE_CHOICE":
          // All selected options should be correct and all correct options should be selected
          const studentSelectedIds = studentAnswer as string[]
          const correctOptionIds = question.options.filter((o) => o.isCorrect).map((o) => o.id)

          isCorrect =
            studentSelectedIds.length === correctOptionIds.length &&
            studentSelectedIds.every((id) => correctOptionIds.includes(id))
          break

        case "NUMERICAL":
          isCorrect = question.correctAnswer === studentAnswer
          break

        case "MATRIX_MATCH":
          // Check if all matches are correct
          const studentMatches = studentAnswer as string[]
          const correctMatches = question.options.map((o) => (o.isCorrect ? "true" : "false"))

          isCorrect = JSON.stringify(studentMatches) === JSON.stringify(correctMatches)
          break
      }

      if (isCorrect) {
        score += question.correctMarks
      } else {
        score += question.incorrectMarks // This will be negative or zero
      }
    }

    // Ensure score is not negative
    score = Math.max(0, score)

    // Create test result
    const result = await prisma.testResult.create({
      data: {
        testId,
        studentId,
        score,
        totalMarks,
        answers: JSON.stringify(answers),
        status: score >= test.passingMarks ? "PASSED" : "FAILED",
        completedAt: new Date(),
      },
    })

    revalidatePath("/student/dashboard")

    return { success: true, resultId: result.id }
  } catch (error) {
    console.error("Error submitting test:", error)
    return { success: false, error: "Failed to submit test" }
  }
}

// Get test result
export async function getTestResult(resultId: string) {
  const auth = await checkAuth()

  if (!auth.authenticated || auth.role !== "STUDENT") {
    throw new Error("Unauthorized")
  }

  const studentId = auth.user.id

  const result = await prisma.testResult.findUnique({
    where: {
      id: resultId,
      studentId,
    },
    include: {
      test: {
        include: {
          questions: {
            include: {
              options: true,
            },
          },
        },
      },
    },
  })

  if (!result) {
    throw new Error("Result not found")
  }

  const answers = JSON.parse(result.answers as string) as Record<string, string | string[]>

  return {
    id: result.id,
    testId: result.testId,
    testTitle: result.test.title,
    subject: result.test.subject,
    score: result.score,
    totalMarks: result.totalMarks,
    passingMarks: result.test.passingMarks,
    status: result.status,
    completedAt: result.completedAt.toISOString(),
    questions: result.test.questions.map((q) => {
      const studentAnswer = answers[q.id]

      let isCorrect = false
      let correctAnswer = ""

      switch (q.type) {
        case "SINGLE_CHOICE":
          const correctOption = q.options.find((o) => o.isCorrect)
          isCorrect = correctOption ? studentAnswer === correctOption.id : false
          correctAnswer = correctOption ? correctOption.text : ""
          break

        case "MULTIPLE_CHOICE":
          const studentSelectedIds = (studentAnswer as string[]) || []
          const correctOptionIds = q.options.filter((o) => o.isCorrect).map((o) => o.id)

          isCorrect =
            studentSelectedIds.length === correctOptionIds.length &&
            studentSelectedIds.every((id) => correctOptionIds.includes(id))

          correctAnswer = q.options
            .filter((o) => o.isCorrect)
            .map((o) => o.text)
            .join(", ")
          break

        case "NUMERICAL":
          isCorrect = q.correctAnswer === studentAnswer
          correctAnswer = q.correctAnswer || ""
          break

        case "MATRIX_MATCH":
          const studentMatches = (studentAnswer as string[]) || []
          const correctMatches = q.options.map((o) => (o.isCorrect ? "true" : "false"))

          isCorrect = JSON.stringify(studentMatches) === JSON.stringify(correctMatches)
          correctAnswer = "Matrix matching" // Simplified for this example
          break
      }

      return {
        id: q.id,
        type: q.type,
        text: q.text,
        studentAnswer,
        correctAnswer,
        isCorrect,
        marks: {
          correct: q.correctMarks,
          incorrect: q.incorrectMarks,
          obtained: isCorrect ? q.correctMarks : q.incorrectMarks,
        },
        options: q.options.map((o) => ({
          id: o.id,
          text: o.text,
          isCorrect: o.isCorrect,
        })),
      }
    }),
  }
}
