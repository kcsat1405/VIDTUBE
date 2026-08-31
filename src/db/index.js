import mongoose from "mongoose"
import {DB_NAME} from "../constants.js"

const connectDB= async()=>{
    try{
        const connecting= await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        console.log(`MongoDb connected: DB host: ${connecting.connection.host}`)
    }
    catch(error){
        console.log("MongoDB Connection Error", error)
        process.exit(1)
    }
}

export default connectDB