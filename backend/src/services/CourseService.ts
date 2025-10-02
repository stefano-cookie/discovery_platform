import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export class CourseService {
  /**
   * Lista tutti i course templates
   */
  async listCourses() {
    const courses = await prisma.course.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        templateType: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            offers: true
          }
        }
      },
      orderBy: {
        templateType: 'asc'
      }
    });

    return courses.map(course => ({
      id: course.id,
      name: course.name,
      description: course.description,
      templateType: course.templateType,
      isActive: course.isActive,
      offersCount: course._count?.offers || 0,
      createdAt: course.createdAt.toISOString()
    }));
  }

  /**
   * Ottieni dettaglio corso singolo
   */
  async getCourseById(id: string) {
    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        offers: {
          select: {
            id: true,
            name: true,
            totalAmount: true,
            installments: true,
            isActive: true,
            partnerCompany: {
              select: {
                id: true,
                name: true,
                referralCode: true
              }
            }
          },
          take: 10
        },
        _count: {
          select: {
            offers: true
          }
        }
      }
    });

    if (!course) {
      return null;
    }

    return course;
  }

}

export default new CourseService();