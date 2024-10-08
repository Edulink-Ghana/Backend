import { Teacher } from "../models/teacherModel.js";
import {loginValidator,registerValidator, teacherValidator,} from "../validators/teacher.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

// teacher registration
export const registerTeacher = async (req, res, next) => {
    try {
        //validate request
        const { value, error } = registerValidator.validate(req.body);
        if (error) {
            return res.status(422).json(error.details[0].message);
        }
        const email = value.email;
        // check if the user exixt
        const UserExist = await Teacher.findOne({ email });
        if (UserExist) {
            return res.status(401).send({ message: "User has already signed Up" });
        }
        // Encrypt user password
        const hashedPassword = bcrypt.hashSync(value.password, 10);
        // Create user
        const newUser = await Teacher.create({
            ...value,
            password: hashedPassword,
        });
        // Generate a verification token
        const token = jwt.sign({ userId: newUser._id }, process.env.JWT_PRIVATE_KEY, { expiresIn: '1h' });
        const verifyEmailToken = await VerificationToken.create({
            userId: newUser._id,
            token: token
        });

        // Send verification email
        await mailTransport.sendMail({
            to: value.email,
            from: "emmanuel@laremdetech.com",
            subject: "Verify Your Email",
            html: `
              <h3>Hello ${newUser.firstName}</h3>
              <p>Please verify your email by clicking on the following link:</p>
              <a href="${process.env.FRONTEND_URL}/verify-email/${verifyEmailToken}">Verify Email</a>
            `,
        });

        // Return response
        res.status(201).json({ message: "Teacher created successfully. Please check your email for verification." });
    } catch (error) {
        next(error);
    }
};

//Session Login
export const login = async (req, res, next) => {
    try {
        // Validate request
        const { value, error } = loginValidator.validate(req.body);
        if (error) {
            return res.status(422).json(error);
        }
        // Find a user with their unique identifier
        const user = await Teacher.findOne({
            $or: [{ userName: value.userName }, { email: value.email }],
        });
        if (!user) {
            return res.status(401).json({ message: "User not found" });
        }
        // Verify their password
        const correctPassword = bcrypt.compareSync(value.password, user.password);
        if (!correctPassword) {
            return res.status(401).json({ message: "Invalid credentials" });
        }
        // Create a session
        req.session.user = { id: user.id };
        // Return response
        res.status(200).json({
            message: "User logged in succesfull",
            user: {
                firstName: user.firstName,
                lastName: user.lastName,
                userName: user.userName,
            },
        });
    } catch (error) {
        next(error);
    }
};

//Token login
export const token = async (req, res, next) => {
    try {
        // Validate request
        const { value, error } = loginValidator.validate(req.body);
        if (error) {
            return res.status(422).json(error.details[0].message);
        }
        // Find a user with their unique identifier
        const user = await Teacher.findOne({
            $or: [{ userName: value.userName }, { email: value.email }],
        });
        if (!user) {
            return res.status(401).json({ message: "User not found" });
        }
        // Verify their password
        const correctPassword = bcrypt.compareSync(value.password, user.password);
        if (!correctPassword) {
            return res.status(401).json({ message: "Invalid credentials" });
        }
        // Create a token
        const token = jwt.sign({ id: user.id }, process.env.JWT_PRIVATE_KEY, {
            expiresIn: "48h",
        });
        // Return response
        res.status(200).json({
            message: "User logged in succesfull",
            accessToken: token,
            user: {
                firstName: user.firstName,
                lastName: user.lastName,
                userName: user.userName,
            },
        });
    } catch (error) {
        next(error);
    }
};

//Teacher Profile
export const profile = async (req, res, next) => {
    try {
        // Get user id from session or request
        const id = req.session?.user?.id || req?.user?.id;
        // Find user by id
        const options = { sort: { startDate: -1 } }
        const teacher = await Teacher.findById(id)
            .select({ password: false })
            .populate({
                path: "bookings",
                select: "timeslot date grade area subject user",
                options,
            });
        // Return response
        res.status(200).json(teacher);
    } catch (error) {
        next(error);
    }
};

// Get All teachers
export const getTeachers = async (req, res, next) => {
    try {
        //Get query params (optional for filtering)
        const { filter = "{}" } = req.query;

        // Get all  teachers
        const allTeachers = await Teacher.find(JSON.parse(filter)).select({
            password: false,
        }); // Exclude password from response
        //return response
        res.status(200).json(allTeachers);
    } catch (error) {
        next(error);
    }
};

// Search for teachers
export const searchTeachers = async (req, res, next) => {
    try {
        // Get search parameters from query
        const { subject, costMin, costMax, curriculum, area, grade, teachingMode } =
            req.query;

        // Build query object based on search parameters
        const query = {};

        if (subject) {
            query.subjects = subject;
        }

        if (costMin && costMax) {
            query.costPerHour = { $gte: costMin, $lte: costMax };
        } else if (costMin) {
            query.costPerHour = { $gte: costMin };
        } else if (costMax) {
            query.costPerHour = { $lte: costMax };
        }

        if (curriculum) {
            query.curriculum = curriculum;
        }

        if (area) {
            query.area = { $in: area.split(",") }; // Search for teachers with any of the areas
        }

        if (grade) {
            query.grade = { $in: grade.split(",") }; // Search for teachers with any of the grades
        }

        if (teachingMode) {
            query.teachingMode = teachingMode;
        }

        // Find teachers matching the query
        const teachers = await Teacher.find(query).select({ password: false }); // Exclude password from response

        // Return response
        res.status(200).json(teachers);
    } catch (error) {
        next(error);
    }
};

// Update teacher
export const updateTeacher = async (req, res, next) => {
    try {
        // Validate request
        const { value, error } = teacherValidator.validate(req.body);
        if (error) {
            return res.status(422).json(error.details[0].message);
        }

        // Get teacher ID from URL parameter
        const teacherId = req.params.id;

        // Find the teacher
        const teacher = await Teacher.findByIdAndUpdate(teacherId, value, {
            new: true,
        });
        if (!teacher) {
            return res.status(404).send({ message: "Teacher not found" });
        }

        // Return response
        res.status(201).json({ message: "Teacher updated", teacher });
    } catch (error) {
        next(error);
    }
};


// Teacher logout
export const logout = async (req, res, next) => {
    try {
        // Destroy user session
        await req.session.destroy();
        // Return response
        res.status(200).json({ message: "User logged out" });
    } catch (error) {
        next(error);
    }
};


