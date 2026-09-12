import{asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import{User} from "../models/user.models.js"
import{uploadOnCloudinary , deleteFromCloudinary} from "../utils/cloudinary.js"
import {ApiResponse} from "../utils/ApiResponse.js"

const generateAccessAndRefreshToken = async(userId)=>{
    try{
        const user= await User.findById(userId)
        if(!user){
            throw new ApiError(404, "User not found")
        }
        const accessToken =user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})
        return {accessToken, refreshToken}
    }catch(error){
        throw new ApiError(500, "Failed to generate access and refresh token")
    }
}


const registerUser= asyncHandler(async(req,res)=>{
    const{fullname,email,username,password}=req.body

    //valdation
    if([fullname,email,username,password].some((field)=>field?.trim()===""))
        {
        throw new ApiError(400, "fullname is required")
    }

    const UserExists = await User.findOne({
        $or: [{username},{email}]
    })

    if(UserExists){
        throw new ApiError(409, "User already exists")
    }

    const avatarLocalPath =req.files?.avatar?.[0]?.path
    const coverLocalPath = req.files?.coverImage?.[0]?.path

    let avatar
    try{
        avatar= await uploadOnCloudinary(avatarLocalPath)
        console.log("avatar uploaded", avatar)
    }catch(error){
        console.log("error uploading avatar",error)
        throw new ApiError(500, "Failed to upload avatar")
    }

     let coverImage
    try{
        coverImage= await uploadOnCloudinary(coverLocalPath)
        console.log("coverImage uploaded", coverImage)
    }catch(error){
        console.log("error coverImage uploading ",error)
        throw new ApiError(500, "Failed to upload coverImage")
    }

    try{
    const user= await User.create({
        fullname,
        avatar:avatar.url,
        coverImage: coverImage?.url||"",
        email,
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken -watchHistory"
    )

    if(!createdUser){
        throw new ApiError(500, "User not created")
    }

    return res
    .status(201)
    .json(new ApiResponse(201, "User created successfully", createdUser))
}catch(error){
    console.log("User creation failed", error)
    if(avatar){
        await deleteFromCloudinary(avatar.public_id)
    }
    if(coverImage){
        await deleteFromCloudinary(coverImage.public_id)
    }

    throw new ApiError(500, "something went wrong while registering user and images were deleted")
}

})

const loginUser= asyncHandler(async(req,res)=>{
    //get data from body
    const {email, username, password} = req.body

    if(!email){
        throw new ApiError(400, "email is required")
    }
    const existedUser = await User.findOne({
        $or: [{username},{email}]
    })
    if(!user){
        throw new ApiError(404, "User not found")
    }
    //validate password
    const isPasswordValid = await user.isPasswordCorrect(password)
    if(!isPasswordValid){
        throw new ApiError(401, "Invalid user credentials")
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id)
    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken -watchHistory"
    )

    const options={
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
    }

    return res.status(200).cookie("refreshToken", refreshToken, options)
    .cookie("accessToken", accessToken, options)
    .json(new ApiResponse(200, {
        user: loggedInUser,
        accessToken,
        refreshToken 
    },"User logged in successfully"))
})

export {registerUser}