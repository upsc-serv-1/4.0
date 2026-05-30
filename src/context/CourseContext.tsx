import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type CourseType = 'UPSC CSE' | 'Medical Science';

interface CourseContextType {
  selectedCourse: CourseType;
  setSelectedCourse: (course: CourseType) => Promise<void>;
  isLoading: boolean;
}

const CourseContext = createContext<CourseContextType | undefined>(undefined);

export const CourseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedCourse, setSelectedCourseState] = useState<CourseType>('UPSC CSE');
  const [isLoading, setIsLoading] = useState(true);

  // Load course preference on mount
  useEffect(() => {
    const loadCourse = async () => {
      try {
        const stored = await AsyncStorage.getItem('selectedCourse');
        if (stored) {
          setSelectedCourseState(stored as CourseType);
        }
      } catch (error) {
        console.error('Error loading selected course:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCourse();
  }, []);

  const setSelectedCourse = async (course: CourseType) => {
    try {
      setSelectedCourseState(course);
      await AsyncStorage.setItem('selectedCourse', course);
    } catch (error) {
      console.error('Error saving selected course:', error);
    }
  };

  return (
    <CourseContext.Provider value={{ selectedCourse, setSelectedCourse, isLoading }}>
      {children}
    </CourseContext.Provider>
  );
};

export const useCourse = () => {
  const context = useContext(CourseContext);
  if (!context) {
    throw new Error('useCourse must be used within a CourseProvider');
  }
  return context;
};
